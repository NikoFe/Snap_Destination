import React from 'react'
import axios from 'axios'
function Posts() {
  const { user, FUNCTIONS_BASE_URL } = useAuth(); // Get user and base URL from context
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAddPost = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user) {
      setError('You must be logged in to add a post.');
      return;
    }

    if (!postTitle || !postContent) {
      setError('Please enter both title and content for the post.');
      return;
    }

    try {
      // Get the ID token from the authenticated user
      const idToken = await user.getIdToken();

      const response = await fetch(`${FUNCTIONS_BASE_URL}/addPost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include the Authorization header with the Bearer token
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: postTitle,
          content: postContent,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage('Post added successfully!');
        setPostTitle('');
        setPostContent('');
      } else {
        setError(`Failed to add post: ${result.error || response.statusText}`);
      }
    } catch (err) {
      console.error("Error adding post:", err);
      setError(`An error occurred: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-8">
      {user && (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl border border-gray-200">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">Add New Post</h2>
          {message && <p className="text-green-600 text-center mb-4">{message}</p>}
          {error && <p className="text-red-600 text-center mb-4">{error}</p>}
          <form onSubmit={handleAddPost} className="space-y-4">
            <div>
              <label htmlFor="postTitle" className="block text-gray-700 text-sm font-medium mb-1">Post Title</label>
              <input
                type="text"
                id="postTitle"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="Enter post title"
                value={postTitle}
                onChange={(e) => setPostTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="postContent" className="block text-gray-700 text-sm font-medium mb-1">Post Content</label>
              <textarea
                id="postContent"
                rows="5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                placeholder="Write your post content here..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                required
              ></textarea>
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
            >
              Add Post
            </button>
          </form>
        </div>
      )}

      {!user && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg text-center w-full max-w-md">
          <p className="font-semibold">Please log in to view and add posts.</p>
        </div>
      )}

      {/* Placeholder for displaying existing posts */}
      <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Your Posts</h3>
        <p className="text-gray-600">No posts to display yet. Add one above!</p>
        {/* In a real application, you would fetch and display posts here */}
      </div>
    </div>
  );
}

// App.jsx (Main Component)
export default function App() {
  const [user, setUser] = useState(null); // Firebase user object
  const [loadingAuth, setLoadingAuth] = useState(true); // To indicate if auth state is being loaded

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) {
        console.log("User is logged in:", currentUser.email, currentUser.uid);
      } else {
        console.log("User is logged out.");
      }
    });

    // Clean up the subscription on unmount
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Successfully logged out.");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  // Provide auth and functions base URL to all components via context
  const authContextValue = {
    user,
    auth,
    FUNCTIONS_BASE_URL,
    handleLogout
  };

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Loading authentication...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <div className="min-h-screen bg-gray-100 font-inter">
        <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-md rounded-b-lg">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">My Firebase App</h1>
            {user && (
              <div className="flex items-center space-x-4">
                <span className="text-lg">Welcome, {user.displayName || user.email}!</span>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="container mx-auto p-6">
          {user ? <Posts /> : <Login />}
        </main>
      </div>
    </AuthContext.Provider>
  );
}