import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, connectAuthEmulator } from 'firebase/auth';
import axios from "axios";

// Create an Authentication Context to share auth state across components
const AuthContext = createContext(null);

// Custom hook to use the AuthContext
const useAuth = () => useContext(AuthContext);

// Main App component
const App = () => {
  // Your web app's Firebase configuration
  // IMPORTANT: Replace with your actual Firebase project configuration

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
    const firebaseConfig = {
      apiKey: "AIzaSyC9GZth2opQWG4KwKqmIa5xHGn1klxRbDY",
      authDomain: "snapdestination-e76e0.firebaseapp.com",
      projectId: "snapdestination-e76e0",
      storageBucket: "snapdestination-e76e0.firebasestorage.app",
      messagingSenderId: "917703824883",
      appId: "1:917703824883:web:907aaab3bfe3800f5e2e86",
      measurementId: "G-FJLNP0KPVQ"
    };



  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [status, setStatus] = useState({ message: 'Not logged in.', isError: false });

  // Helper function to update the status text
  const updateStatus = (message, isError = false) => {
    setStatus({ message, isError });
    console.log(message);
  };
  
  // Initialize Firebase and connect to emulators once
  const [app, setApp] = useState(null);
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    try {
      if (firebaseConfig.projectId === "your-project-id") {
        updateStatus("Warning: Please replace 'your-project-id' with your actual Firebase project ID in firebaseConfig.", true);
        return;
      }
      
      const firebaseApp = initializeApp(firebaseConfig);
      const firebaseAuth = getAuth(firebaseApp);
      
      // Connect to the Firebase Emulators for development
      // This URL must match the output from 'firebase emulators:start'
      console.log("Attempting to connect to Firebase Auth emulator at http://127.0.0.1:9099");
      connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099");
      
      setApp(firebaseApp);
      setAuth(firebaseAuth);
    } catch (error) {
      updateStatus(`Firebase Initialization Failed: ${error.message}`, true);
    }
  }, []);

  // Effect to listen for authentication state changes
  useEffect(() => {
    if (!auth) return; // Ensure auth object is initialized
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        updateStatus(`Logged in as: ${user.email} (UID: ${user.uid})`);
      } else {
        updateStatus("Not logged in.");
      }
    });
    return () => unsubscribe(); // Cleanup the listener on unmount
  }, [auth]);

  // The URL for your serverless functions
  const functionsUrl = "http://127.0.0.1:5001";

  // Event handlers for UI interactions
  const handleRegister = async () => {
    if (!email || !password) {
      updateStatus("Please enter an email and password to register.", true);
      return;
    }
    if (!auth) {
        updateStatus("Firebase Auth is not initialized.", true);
        return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged listener will handle UI updates
    } catch (error) {
      updateStatus(`Registration failed: ${error.message}`, true);
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
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged listener will handle UI updates
    } catch (error) {
      updateStatus(`Login failed: ${error.message}`, true);
    }
  };
  
  const handleCallLoginFunction = async () => {
    if (!currentUser) {
      updateStatus("You must be logged in to call this function.", true);
      return;
    }
    
    try {
      const token = await currentUser.getIdToken();
      updateStatus("Fetching ID token and calling the `login` function...");
      
      // IMPORTANT: Replace with your function URL
      const loginUrl = `${functionsUrl}/snapdestination-e76e0/us-central1/login`; 
      
      const response = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      updateStatus(`Server Login Function Response:\n${JSON.stringify(data, null, 2)}`);
    } catch (error) {
      updateStatus(`Failed to call serverless 'login' function: ${error.message}`, true);
    }
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
    
    try {
      const token = await currentUser.getIdToken();
      updateStatus("Fetching ID token and calling the `addPost` function...");
      
      // IMPORTANT: Replace with your function URL
      const addPostUrl = `${functionsUrl}/snapdestination-e76e0/us-central1/addPost`; 
      
      const customHeader = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      const response = await axios.post(addPostUrl,{
        title:postTitle,
        content:postContent,
        }, {headers:customHeader });

      /*
      const response = await fetch(addPostUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body:JSON.stringify({ title: postTitle, content: postContent })
      });*/


 
      console.log("MMMMMMMMMMMM: ", JSON.stringify(response.data))
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      updateStatus(`Server Add Post Function Response:\n${JSON.stringify(data, null, 2)}`);
      setPostTitle('');
      setPostContent('');
      
    } catch (error) {
      updateStatus(`Failed to call serverless 'addPost' function: ${error.message}`, true);
    }
  };

  return (
    <div className="bg-gray-100 flex items-center justify-center min-h-screen p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Test Client</h1>
        
        {/* Authentication Section */}
        <div className={currentUser ? 'hidden' : 'space-y-4'}>
          <h2 className="text-xl font-semibold text-gray-700">Login</h2>
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
        <div className={currentUser ? 'mt-6 space-y-4' : 'hidden'}>
          <h2 className="text-xl font-semibold text-gray-700">Authenticated Actions</h2>
          <button
            onClick={handleCallLoginFunction}
            className="w-full bg-purple-600 text-white font-medium py-2 px-4 rounded-md hover:bg-purple-700 transition duration-300 ease-in-out"
          >
            Call Server `login` Function
          </button>
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
            <button
              onClick={handleAddPost}
              className="w-full bg-orange-600 text-white font-medium py-2 px-4 rounded-md hover:bg-orange-700 transition duration-300 ease-in-out"
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
        </div>
        
        {/* Results Section */}
        <div id="results" className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <h3 className="font-semibold text-gray-700">Status:</h3>
          <pre 
            id="statusText" 
            className={`mt-2 text-sm whitespace-pre-wrap ${status.isError ? 'text-red-500' : 'text-green-500'}`}
          >
            {status.message}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default App;
