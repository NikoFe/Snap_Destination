import React from 'react'
import axios from 'axios'
import Posts from './Posts'
function Login() {
  const { auth, FUNCTIONS_BASE_URL } = useAuth(); // Get auth instance and base URL from context
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // For registration
  const [friends, setFriends] = useState(''); // For registration (comma-separated)
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      if (isRegistering) {
        // Register user with Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Firebase Auth registration successful:", user.uid);

        // Call your Cloud Function to store additional user data (like friends)
        const registerResponse = await fetch(`${FUNCTIONS_BASE_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Authorization header needed here, as the user is just created via client-side Auth
          },
          body: JSON.stringify({
            email: email,
            password: password, // Sending password again is generally not recommended for backend
                                 // unless the backend needs to re-hash it for a separate system.
                                 // For Firebase Auth, it's not needed, but your Cloud Function expects it.
            name: username,
            friends: friends.split(',').map(f => f.trim()),
          }),
        });

        const registerResult = await registerResponse.json();
        if (registerResponse.ok) {
          setMessage('Registration successful! Please log in.');
          setIsRegistering(false); // Switch to login view after successful registration
        } else {
          setError(`Registration failed on backend: ${registerResult.error}`);
          // Consider deleting the Firebase Auth user if backend registration fails
          // await user.delete();
        }

      } else {
        // Sign in user with Firebase Authentication
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Firebase Auth sign-in successful:", user.uid);

        // Optional: Call your Cloud Function login endpoint to fetch additional data
        // (Your backend login function just verifies an ID token and returns user data)
        const idToken = await user.getIdToken();
        const loginResponse = await fetch(`${FUNCTIONS_BASE_URL}/login`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        const loginResult = await loginResponse.json();
        if (loginResponse.ok) {
          setMessage(`Login successful! Welcome, ${loginResult.displayName || loginResult.email}.`);
        } else {
          setError(`Failed to fetch user data from backend: ${loginResult.error}`);
        }
      }
    } catch (error) {
      console.error("Authentication error:", error);
      // Firebase Auth error codes for user-friendly messages
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please try logging in or use a different email.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else {
        setError(`Authentication failed: ${error.message}`);
      }
    }
  };

  return (
    <div className="flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-200">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          {isRegistering ? 'Register' : 'Login'}
        </h2>
        {message && <p className="text-green-600 text-center mb-4">{message}</p>}
        {error && <p className="text-red-600 text-center mb-4">{error}</p>}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="your@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {isRegistering && (
            <>
              <div>
                <label htmlFor="username" className="block text-gray-700 text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  id="username"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="John Doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="friends" className="block text-gray-700 text-sm font-medium mb-1">Friends (comma-separated)</label>
                <input
                  type="text"
                  id="friends"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
                  placeholder="Alice, Bob, Charlie"
                  value={friends}
                  onChange={(e) => setFriends(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            {isRegistering ? 'Register' : 'Login'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          {isRegistering ? 'Already have an account?' : 'Don\'t have an account?'}
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setMessage('');
              setError('');
            }}
            className="text-blue-600 hover:text-blue-800 font-semibold ml-2"
          >
            {isRegistering ? 'Login here' : 'Register here'}
          </button>
        </p>
      </div>
    </div>
  );
}