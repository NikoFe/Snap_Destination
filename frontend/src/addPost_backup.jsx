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
        
        // Use a FileReader to convert the image file to a Base64 string
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1]; // Get only the Base64 part
            resolve(base64Data);
          };
          reader.onerror = reject;
        });

        reader.readAsDataURL(imageFile);
        const imageData = await base64Promise;

        const uploadUrl = `${functionsUrl}/${firebaseConfig.projectId}/us-central1/uploadImage`;
        const uploadResponse = await axios.post(uploadUrl, {
          imageData: imageData,
          filename: imageFile.name,
          mimeType: imageFile.type,
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json', // Send as JSON
          },
        });

       uploadedImageUrl = uploadResponse.data.url;
        updateStatus(`////////////////////////////: ${uploadResponse}`);
        updateStatus(`////////////////////////////:`, JSON.stringify(uploadResponse));
        updateStatus(`////////////////////////////: ${uploadResponse.data}`);
        updateStatus(`////////////////////////////:`, JSON.stringify(uploadResponse.data));

     //   uploadedImageUrl = uploadResponse.data.url;
     //  if (isEmulator) {
        // Assume the bucket name is the project ID from your config
        const bucketName = firebaseConfig.projectId + '.appspot.com'; 
        // Build the emulator URL using the host and port from your functionsUrl
        const emulatorHost = new URL(functionsUrl).hostname;
        const emulatorPort = new URL(functionsUrl).port;
        // The URL format for Storage emulator is different from production.
        const path = uploadedImageUrl.split('.com/')[1];
        uploadedImageUrl = `http://${emulatorHost}:${emulatorPort}/v0/b/${bucketName}/o/${encodeURIComponent(path)}`;
    //  }




        updateStatus(`Image uploaded successfully. URL: ${uploadedImageUrl}`);
      }
      updateStatus("Fetching ID token and calling the `addPost` function...");
      // IMPORTANT: Replace with your function URL
      const addPostUrl = `${functionsUrl}/snapdestination-e76e0/us-central1/addPost`; 
   
      const customHeader = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
      console.log("D")
      const response = await axios.post(addPostUrl,{
        title:postTitle,
        content:postContent,
        imageUrl: uploadedImageUrl
        }, {headers:customHeader });
   //   console.log("MMMMMMMMMMMM: ", JSON.stringify(response))
      console.log("MMMMMMMMMMMM: ", JSON.stringify(response.data.fullPost))