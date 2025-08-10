import React, { useState, useEffect, createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
} from "firebase/auth";
import axios from "axios";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import UserSelect from "./UserSelect";
import Post from "./Post";
import "./App.css";
const App = () => {
  const functionsUrl = "http://127.0.0.1:5001";
  const firebaseConfig = {
   apiKey: "AIzaSyC9GZth2opQWG4KwKqmIa5xHGn1klxRbDY",
    authDomain: "snapdestination-e76e0.firebaseapp.com",
    projectId: "snapdestination-e76e0",
    storageBucket: "snapdestination-e76e0.firebasestorage.app",
    messagingSenderId: "917703824883",
    appId: "1:917703824883:web:907aaab3bfe3800f5e2e86",
    measurementId: "G-FJLNP0KPVQ",
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentId, setCurrentId] = useState(null);
  const [password, setPassword] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [status, setStatus] = useState({
    message: "Not logged in.",
    isError: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [authUsers, setAuthUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [friendList, setFriendList] = useState("");


  // Initialize Firebase and connect to emulators once
  const [app, setApp] = useState(null);
  const [auth, setAuth] = useState(null);
  const [storage, setStorage] = useState(null);

  const updateStatus = (message, isError = false) => {
    setStatus({
      message,
      isError
    });
    console.log(message);
  };

  const debugPrint = () => {
    console.log("authUsers", authUsers);
    console.log("CURRENT_ID", currentId);
    console.log("username", username);
    for (let i = 0; i < posts.length; i++) {
      console.log("* ", posts[i]);
      console.log("* id ", posts[i].id);
      console.log("* title ", posts[i].data.title);
    }
  };

  const fetchAuthUsers = async () => {
    if (!auth) return;
    try {
      const getUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/getUsers`;
      const getResponse = await axios.get(getUrl);
      setAuthUsers(getResponse.data.users);
    } catch (error) {
      const serverError = error.response ? error.response.data.error : error.message;
      updateStatus(`Failed to fetch users: ${serverError}`, true);
    }
  };

  const fetchUserPostsAndFriends = async (userId) => {
    try {
      if (!auth || !userId) return;

      // Reset posts to prevent duplication
      setPosts([]);

      // Fetch user's own posts
      const getPostsUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/getPosts?userId=${userId}`;
      const postsResponse = await axios.get(getPostsUrl);
      setPosts(postsResponse.data.posts);

      // Fetch friends and their posts in parallel
      const getFriendsUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/getFriends?userId=${userId}`;
      const friendsResponse = await axios.get(getFriendsUrl);
      const friends = friendsResponse.data.friends;

      const friendPostPromises = friends.map((friend) =>
        axios.get(`${functionsUrl}/${firebaseConfig.projectId}/us-central1/getPosts?userId=${friend.id}`)
      );

      const friendPostsResponses = await Promise.all(friendPostPromises);
      const friendPosts = friendPostsResponses.flatMap((res) => res.data.posts);

      setPosts((prevPosts) => [...prevPosts, ...friendPosts]);

    } catch (error) {
      const serverError = error.response ? error.response.data.error : error.message;
      updateStatus(`Failed to fetch posts or friends: ${serverError}`, true);
    }
  };

  // Main initialization effect
  useEffect(() => {
    try {
      if (firebaseConfig.projectId === "your-project-id") {
        updateStatus("Warning: Please replace 'your-project-id' with your actual Firebase project ID in firebaseConfig.", true);
        return;
      }
      const firebaseApp = initializeApp(firebaseConfig);
      const firebaseAuth = getAuth(firebaseApp);
      const firebaseStorage = getStorage(firebaseApp);

      connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099");
      setApp(firebaseApp);
      setAuth(firebaseAuth);
      setStorage(firebaseStorage);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        setCurrentUser(user);
        if (user) {
          updateStatus(`Logged in as: ${user.email} (UID: ${user.uid})`);
          // Fetch user-specific ID after login
          const getUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/getSingleUser?email=${user.email}`;
          const response = await axios.get(getUrl);
          setCurrentId(response.data.user.id);
        } else {
          updateStatus("Not logged in.");
          setPosts([]);
          setCurrentId(null);
        }
      });
      return () => unsubscribe();
    } catch (error) {
      updateStatus(`Firebase Initialization Failed: ${error.message}`, true);
    }
  }, []);

  // Fetch all users when auth is initialized
  useEffect(() => {
    if (auth) {
      fetchAuthUsers();
    }
  }, [auth, functionsUrl, firebaseConfig]);

  // Fetch posts and friends when currentId is set
  useEffect(() => {
    if (currentId) {
      fetchUserPostsAndFriends(currentId);
    }
  }, [currentId]);


  // Event handlers for UI interactions
  const handleRegister = async () => {
    if (!username || !email || !password) {
      updateStatus("Please enter an email and password to register.", true);
      return;
    }
    if (!auth) {
      updateStatus("Firebase Auth is not initialized.", true);
      return;
    }
    setIsLoading(true);

    try {
      const friendsToAdd = authUsers
        .filter((user) => selectedUsers.includes(user.data.displayName))
        .map((user) => user.id);

      const registerUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/register`;
      const response = await axios.post(registerUrl, {
        email: email,
        password: password,
        name: username,
        friends: friendsToAdd,
      });

      updateStatus(`Registration successful. Response: ${JSON.stringify(response.data)}`);

      await signInWithEmailAndPassword(auth, email, password);

    } catch (error) {
      updateStatus(`Registration failed: ${error.message}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      updateStatus("Please enter an email and password to log in.", true);
      return;
    }
    if (!auth) {
      updateStatus("Firebase Auth is not initialized.", true);
      return;
    }

    setIsLoading(true);
    setPosts([]);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      updateStatus(`Login successful!`);
    } catch (error) {
      updateStatus(`Login failed: ${error.message}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0] || null);
  };

  const handleAddPost = async () => {
    if (!currentUser) {
      updateStatus("You must be logged in to add a post.", true);
      return;
    }
    if (!postTitle || !postContent) {
      updateStatus("Please enter a title and content for the post.", true);
      return;
    }

    setIsLoading(true);
    let uploadedImageUrl = null;

    try {
      const token = await currentUser.getIdToken();
      if (imageFile) {
        updateStatus("Uploading image to Cloud Storage via Cloud Function...");

        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
        });

        reader.readAsDataURL(imageFile);
        const imageData = await base64Promise;

        const uploadUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/uploadImage`;
        const uploadResponse = await axios.post(uploadUrl, {
          imageData,
          filename: imageFile.name,
          mimeType: imageFile.type,
        }, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        uploadedImageUrl = uploadResponse.data.url;
        updateStatus(`Image uploaded successfully. URL: ${uploadedImageUrl}`);
      }

      const addPostUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/addPost`;
      const response = await axios.post(addPostUrl, {
        title: postTitle,
        content: postContent,
        imageUrl: uploadedImageUrl,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      // Update posts state with the new post
      setPosts((prevPosts) => [...prevPosts, response.data.fullPost]);

      updateStatus(`Post added successfully!`);
      setPostTitle("");
      setPostContent("");
      setImageFile(null);
      document.getElementById("image-upload-input").value = null; // Reset file input
    } catch (error) {
      const serverError = error.response ? error.response.data.error : error.message;
      updateStatus(`Failed to add post: ${serverError}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 flex items-center justify-center min-h-screen p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Test Client
        </h1>
        {/* Authentication Section */}
        <div className={currentUser ? "hidden" : "space-y-4"}>
          {/*<h2 className="text-xl font-semibold text-gray-700">Login</h2>*/}
          <UserSelect
            users={authUsers}
            selectedUsers={selectedUsers}
            setSelectedUsers={setSelectedUsers}
          ></UserSelect>

          <input
            id="username-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <input
            id="email-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            id="password-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            id="friendlist-input"
            type="text"
            placeholder="Friendlist"
            value={friendList}
            onChange={(e) => setFriendList(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex space-x-2">
            <button
              onClick={handleLogin}
              className="flex-1 bg-blue-600 text-white font-medium py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out"
            >
              Log In
            </button>
            <button
              onClick={handleRegister}
              className="flex-1 bg-green-600 text-white font-medium py-2 px-4 rounded-md hover:bg-green-700 transition duration-300 ease-in-out"
            >
              Register
            </button>
          </div>
        </div>

        {/* Authenticated Actions Section */}
        <div className={currentUser ? "mt-6 space-y-4" : "hidden"}>
          <h2 className="text-xl font-semibold text-gray-700">
            Authenticated Actions
          </h2>
          {/*
          <button
           // onClick={handleCallLoginFunction}
            onClick={handleLogin}
            className="w-full bg-purple-600 text-white font-medium py-2 px-4 rounded-md hover:bg-purple-700 transition duration-300 ease-in-out"
          >
            Call Server `login` Function
          </button>*/}
          <div className="mt-4">
            <input
              id="postTitle"
              type="text"
              placeholder="Post Title"
              value={postTitle}
              onChange={(e) => setPostTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <textarea
              id="postContent"
              placeholder="Post Content"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
            />
            <label className="block text-gray-700 font-medium my-2">
              Add an image:
              <input
                id="image-upload-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="mt-1 block w-full text-sm text-gray-500
                         file:mr-4 file:py-2 file:px-4
                         file:rounded-md file:border-0
                         file:text-sm file:font-semibold
                         file:bg-blue-50 file:text-blue-700
                         hover:file:bg-blue-100"
              />
            </label>
            {imageFile && (
              <p className="text-sm text-gray-500 italic mt-1">
                Selected file: {imageFile.name}
              </p>
            )}
            <button
              onClick={handleAddPost}
              className={`w-full mt-2 text-white font-medium py-2 px-4 rounded-md transition duration-300 ease-in-out `}
            >
              Add Post
            </button>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full mt-4 bg-red-600 text-white font-medium py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 ease-in-out"
          >
            Log Out
          </button>
          <button
            onClick={() => {
              debugPrint();
            }}
            className="w-full mt-4 bg-red-600 text-white font-medium py-2 px-4 rounded-md hover:bg-red-700 transition duration-300 ease-in-out"
          >
            TEST123
          </button>
        </div>

        {/* Results Section */}
        <div
          id="results"
          className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md"
        >
          <h3 className="font-semibold text-gray-700">Status:</h3>
          <pre
            id="statusText"
            className={`mt-2 text-sm whitespace-pre-wrap ${
              status.isError ? "text-red-500" : "text-green-500"
            }`}
          >
            {status.message}
          </pre>
        </div>
        {posts.map((post, index) => (
          <Post post={post}></Post>
        ))}
      </div>
    </div>
  );
};

export default App;