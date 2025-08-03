const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore,getStorage} = require("firebase-admin/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { getAuth } = require("firebase-admin/auth"); // Import Firebase Admin Auth for user management
//
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp();
}
//
/*
initializeApp({
  storageBucket: "your-bucket-name.appspot.com",
});*/


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
});
/*
exports.addPost = functions.https.onCall(async (data, context) => {
    // The `context.auth` object is automatically populated by Firebase SDKs.
    // If it's missing, the request is unauthenticated.
    logger.info("data :", data);
    logger.info("string data :", JSON.stringify(data));
    try{
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'You must be logged in to add a post.'
        );
    }
    const userId = context.auth.uid;
    const { title, content } = data;
    
    if (!title || !content) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Missing title or content for the post.'
        );
    }
    try {
        const postRef = await getFirestore().collection("posts").add({
            userId: userId,
            title: title,
            content: content,
            createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use a server timestamp
        });
        
        // This is a cleaner way to return success
        return { result: `Post added successfully with ID: ${postRef.id}` };
    } catch (error) {
        functions.logger.error(`Error adding post for user ${userId}:`, error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to add post',
            error.message
        );
    }
  }catch(error){
    logger.error("AAAAA error:", error);

    res.status(500).json({ error: "Internal server error during user data retrieval." });
  }
    
});
*/
exports.addPost = functions.https.onRequest(async (req, res) => {
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

    const { title, content } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: "Missing title or content for the post." });
      return;
    }

    const postRef = await getFirestore().collection("posts").add({
      userId: userId,
      title: title,
      content: content,
      createdAt: new Date(),
    });
    
    res.status(201).json({ result: `Post added successfully with ID: ${postRef.id}` });
  } catch (error) {
    // If the token is invalid or any other error occurs, return a 401
    functions.logger.error(`Error verifying token or adding post:`, error);
    res.status(401).json({ error: "Unauthorized. Invalid token or other error." });
  }
});





// This is the new function to be added to your index.js file.
// It triggers whenever a new document is created in the 'posts' collection.

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


/*
exports.deleteOldPosts = onSchedule("every 5 minutes", async () => {
  const nMinutes = 10;
  const cutoff = new Date(now - nMinutes * 60 * 1000);
  const snapshot = await getFirestore().collection("posts")
    .where("timestamp", "<", cutoff)
    .get();

  const deletes = [];
  snapshot.forEach(doc => deletes.push(doc.ref.delete()));
  await Promise.all(deletes);

  logger.info(`Deleted ${deletes.length} old posts`);
});*/

