const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore,getStorage} = require("firebase-admin/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getAuth } = require("firebase-admin/auth"); // Import Firebase Admin Auth for user management
const { v4: uuidv4 } = require('uuid');

//
const logger = require("firebase-functions/logger");
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

exports.onFileUpload = onObjectFinalized(async (event) => {
  const file = event.data;
  const filePath = file.name;
  const contentType = file.contentType;
  const size = file.size;
  const bucket = file.bucket;

  logger.info(`File uploaded: ${filePath}, type: ${contentType}, size: ${size} bytes, bucket: ${bucket}`);

  if (!contentType  || !contentType.startsWith("image/")) {
    logger.info(`This is not an image: ${filePath}`);
    return null;
  }
  const publicUrl = `https://storage.googleapis.com/${bucket}/${filePath}`;
  //const publicUrl = `https://storage.googleapis.com/<span class="math-inline">\{bucket\}/</span>{filePath}`;
  logger.info(`Public URL for uploaded image: ${publicUrl}`);
  try {
    await getFirestore().collection("images").add({
      filePath: filePath,
      publicUrl: publicUrl,
      contentType: contentType,
      size: size,
      uploadDate: new Date(),
    });
    logger.info(`Image metadata stored in Firestore for ${filePath}`);
  } catch (error) {
    logger.error(`Error storing image metadata for ${filePath}:`, error);
  }
  return null;
});

exports.addPost = functions.https.onRequest(async (req, res) => {

  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests to allow preflight checks
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: "Method Not Allowed. Use POST." });
    return;
  }
  
  // Get the ID token from the Authorization header
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: "Unauthorized. No valid token found." });
    return;
  }

  const idToken = authorizationHeader.split('Bearer ')[1];
  
  try {
    // Manually verify the token using the Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid; // Get the user ID from the verified token

    const { title, content, imageUrl } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: "Missing title or content for the post." });
      return;
    }

    const postRef = await getFirestore().collection("posts").add({
      userId: userId,
      title: title,
      content: content,
      imageUrl: imageUrl || null, 
      createdAt: new Date(),
    });
    
    res.status(201).json({ result: `Post added successfully with ID: ${postRef.id}` });
  } catch (error) {
    // If the token is invalid or any other error occurs, return a 401
    functions.logger.error(`Error verifying token or adding post:`, error);
    res.status(401).json({ error: "Unauthorized. Invalid token or other error." });
  }
});

exports.onNewPostNotification = onDocumentCreated("posts/{postId}", async (event) => {
  // Extract the newly created post document from the event.
  const postSnapshot = event.data;
  if (!postSnapshot) {
    logger.info("No data associated with the event.");
    return;
  }
  const newPost = postSnapshot.data();
  const postId = postSnapshot.id;
  const authorUserId = newPost.userId; // Get the ID of the user who made the post

  logger.info(`New post created with ID: ${postId} by user: ${authorUserId}`);

  try {
    const db = getFirestore();

    // 1. Fetch the author's user document to get their friends list.
    logger.info(`author user ID: ${authorUserId}`);
    console.log(`author user ID: ${authorUserId}`)
    const userDocRef = db.collection("users").doc(authorUserId);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      logger.warn(`User document not found for author: ${authorUserId}. Cannot notify friends.`);
      return;
    }

    const userData = userDoc.data();
    const friendsList = userData.friends || []; // Get the friends array, default to empty

    if (friendsList.length === 0) {
      logger.info(`User ${authorUserId} has no friends to notify.`);
      return;
    }

    // 2. Iterate through the author's friends and create a notification for each.
    // For this example, we will use a 'notifications' subcollection under each user.
    // In a real-world app, you might use a service like Firebase Cloud Messaging (FCM).
    const batch = db.batch();
    const notificationMessage = `Your friend has a new post: "${newPost.title}"`;

    for (const friendUid of friendsList) {
      // Create a reference to the notification document for this friend.
      const friendNotificationRef = db
        .collection("users")
        .doc(friendUid)
        .collection("notifications")
        .doc(); // Let Firestore auto-generate the notification ID

      batch.set(friendNotificationRef, {
        postId: postId,
        authorId: authorUserId,
        message: notificationMessage,
        read: false, // Flag to track if the notification has been read
        createdAt: new Date(),
      });

      logger.info(`Prepared notification for friend ${friendUid}`);
    }

    // 3. Commit the batch write to Firestore. This is more efficient than
    // multiple individual writes.
    await batch.commit();

    logger.info(`Notifications created for ${friendsList.length} friends of user ${authorUserId}.`);

  } catch (error) {
    logger.error("Error creating new post notifications:", error);
  }
});

exports.register = onRequest(async (req, res) => {
  // Ensure the request method is POST for sensitive operations like registration
  if (req.method !== 'POST') {
    res.status(405).json({ error: "Method Not Allowed. Use POST." });
    return;
  }
  // Extract user registration data from the request body
  const { email, password, name, friends: rawFriends } = req.body;
  // Basic validation for required fields
  if (!email || !password || !name) {
    res.status(400).json({ error: "Missing email, password, or name in request body" });
    return;
  }
  // Normalize friends data: ensure it's an array of strings
  const friends = Array.isArray(rawFriends)
    ? rawFriends
    : typeof rawFriends === "string"
      ? rawFriends.split(",").map(f => f.trim())
      : [];
  try {
    const userRecord = await getAuth().createUser({
      email: email,
      password: password,
      displayName: name, // Set display name for the user
    });

    logger.info(`userRecord.email: ${userRecord.email}`);
    logger.info(`userRecord displayName: ${userRecord.displayName}`);
    logger.info(`friends: ${friends}`);
    await getFirestore().collection("users").doc(userRecord.uid).set({
      email: userRecord.email,
      displayName: userRecord.displayName,
      friends: friends,
      createdAt: new Date(), // Record creation timestamp
    });
    logger.info(`User registered successfully. UID: ${userRecord.uid}, Email: ${userRecord.email}`);
    res.status(201).json({ result: `User registered successfully with UID: ${userRecord.uid}` });

  } catch (error) {
    logger.error("Error during user registration:", error);
    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({ error: "Registration failed: This email is already registered." });
    } else {
      res.status(500).json({ error: "Failed to register user", details: error.message });
    }
  }
});
/*
exports.login = onRequest(async (req, res) => {
  if (req.method !== 'GET') {
      res.status(405).json({ error: "Method Not Allowed. Use GET." });
      return;
  }
  if (!req.auth) {
    res.status(401).json({ error: "Unauthorized. Please provide a valid Firebase ID token." });
    return;
  }
  const uid = req.auth.uid; // Get the User ID from the authenticated request object
  logger.info(`Login endpoint accessed by authenticated user: ${uid}`);
  try {
    const userDoc = await getFirestore().collection("users").doc(uid).get();
    let userDataFromFirestore = {};
    if (userDoc.exists) {
      userDataFromFirestore = userDoc.data();
      logger.info(`Firestore data found for user ${uid}`);
    } else {
      logger.warn(`User profile data not found in Firestore for UID: ${uid}`);
    }
    res.status(200).json({
      message: "Authenticated successfully",
      uid: uid,
      email: req.auth.token.email, // Email from the ID token
      displayName: req.auth.token.name || "N/A", // Display name from ID token
      friends: userDataFromFirestore.friends || [],
    });

  } catch (error) {
    logger.error("Error processing authenticated login request:", error);
    res.status(500).json({ error: "Internal server error during user data retrieval." });
  }
});*/

exports.uploadImage = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verify the user's token before processing the upload
  const authorizationHeader = req.headers.authorization;
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized');
    return;
  }

  const idToken = authorizationHeader.split('Bearer ')[1];
  try {
    await getAuth().verifyIdToken(idToken);
  } catch (error) {
    logger.error("Token verification failed:", error);
    res.status(401).send('Unauthorized');
    return;
  }

  // Extract the Base64 data and metadata from the JSON body
  const { imageData, filename, mimeType } = req.body;
  if (!imageData || !filename || !mimeType) {
    res.status(400).send('Missing image data, filename, or mimeType.');
    return;
  }

  try {
    // Decode the Base64 string into a Buffer
    const imageBuffer = Buffer.from(imageData, 'base64');
    
    const bucket = admin.storage().bucket();
    const uuid = uuidv4();
    const destination = `images/${uuid}-${filename}`;
    
    const file = bucket.file(destination);
    
    // Save the buffer directly to Firebase Storage
    await file.save(imageBuffer, {
      metadata: {
        contentType: mimeType,
      },
      public: true, // Make the file publicly accessible
      gzip: true,
      cacheControl: 'public, max-age=31536000',
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
    
    res.status(200).json({ url: publicUrl });
  } catch (error) {
    logger.error('Error during file upload:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});


exports.deleteOldPosts = onSchedule("every 1 minutes", async () => {
  const nMinutes = 1;
  const now = new Date(); // Define `now` here
  const cutoff = new Date(now - nMinutes * 60 * 1000);
  logger.info('CUTOFF:', cutoff);
  const snapshot = await getFirestore().collection("posts")
    .where("timestamp", "<", cutoff)
    .get();

  const deletes = [];
  snapshot.forEach(doc => deletes.push(doc.ref.delete()));
  await Promise.all(deletes);

  logger.info(`Deleted ${deletes.length} old posts`);
});

