import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDS4bt_r2zFlUl1y2yS8v3uTDMgtIFfqLE",
  authDomain: "optical-queue.firebaseapp.com",
  projectId: "optical-queue",
  storageBucket: "optical-queue.firebasestorage.app",
  messagingSenderId: "958811102543",
  appId: "1:958811102543:web:65b19cd3f68998de77b93a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export firestore ไปใช้ในหน้าอื่นๆ
export const db = getFirestore(app);