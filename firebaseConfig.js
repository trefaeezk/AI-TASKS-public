// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// Export the config object
export const firebaseConfig = {
  apiKey: "AIzaSyBIJrQX5HBBnP7LKzgsUNdWCX7aqhVG3wA", // Updated API Key
  authDomain: "tasks-intelligence.firebaseapp.com", // Updated domain
  projectId: "tasks-intelligence", // Updated project ID
  storageBucket: "tasks-intelligence.appspot.com", // Updated storage bucket
  messagingSenderId: "770714758504", // Updated project number
  appId: "1:770714758504:web:aea98ba39a726df1ba3add" // Actual App ID
};

// Initialize Firebase - This initialization might become redundant if done elsewhere
// const app = initializeApp(firebaseConfig);
// Consider removing the initializeApp call here if it's handled centrally in src/config/firebase.ts

// If you keep the initialization here, export the app instance as well:
// export const app = initializeApp(firebaseConfig);
