  /* previous handleLogin
  const handleLogin = async () => {
    try {
    if (!email || !password) {
      updateStatus("Please enter an email and password to log in.", true);
      return;
    }
    if (!auth) {
        updateStatus("Firebase Auth is not initialized.", true);
        return;
    }
     updateStatus("Signing in with Firebase Authentication...");
     
     await signInWithEmailAndPassword(auth, email, password);
      if (!currentUser) {
        updateStatus("You must be logged in to call this function.", true);
        return;
      }
      updateStatus("Signing in with Firebase Authentication...");
      const token = await currentUser.getIdToken();
      updateStatus("Fetching ID token and calling the `login` function...");
      const loginUrl = `${functionsUrl}/snapdestination-e76e0/us-central1/login`; 
      
      const response = await fetch(loginUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
       updateStatus("response of login: ", JSON.stringify(response) );

      //////////////////////////////////////////
      
      // onAuthStateChanged listener will handle UI updates
    } catch (error) {
      updateStatus(`Login failed: ${error.message}`, true);
    }
  };*/