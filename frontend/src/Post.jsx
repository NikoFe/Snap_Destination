import React from 'react'
import { useState, useEffect, createContext, useContext } from 'react';

const Post = ({post/*content, createdAt, imageUrl,title, userId */}) => {

  useEffect(() => {
    try {
    console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
     console.log("post", post)
    console.log("post.id", post.id)
    console.log("post.data.title", post.data.title)

    console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
    } catch (error) {
      console.log(`POST ERROR: ${error.message}`);
    }
  }, []);

  const formattedDate = post.data.createdAt 
    ? new Date(post.data.createdAt._seconds * 1000).toLocaleString() 
    : 'N/A';


  return (
    <div
    className="post"
    > 
    <p>createdAt:  {formattedDate}</p>
    <p>imageUrl: {post.data.imageUrl}</p>
    <p>title: {post.data.title}</p>
    <p>userId: {post.data.userId}</p>
    <p>content: {post.data.content}</p>
    
    </div>
  )
}

export default Post