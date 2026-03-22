import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, doc, getDocFromServer, getDocs, Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.projectId); 
export const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

// Auth functions
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

// Firestore connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

export async function saveUserHistory(data: any) {
  if (!auth.currentUser) return;

  try {
    // Upload image to Storage if it's a base64 string
    let imageUrl = data.media.uploadedImageURL;
    if (imageUrl && imageUrl.startsWith('data:image')) {
      const storageRef = ref(storage, `history/${auth.currentUser.uid}/${Date.now()}.jpg`);
      await uploadString(storageRef, imageUrl, 'data_url');
      imageUrl = await getDownloadURL(storageRef);
    }

    const historyDoc = {
      user: {
        uid: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        displayName: auth.currentUser.displayName
      },
      context: {
        siteName: data.context.siteName,
        locationName: data.context.locationName,
        coordinates: data.context.coordinates
      },
      content: {
        fullStoryText: data.content.fullStoryText,
        fullMythologyText: data.content.fullMythologyText,
        suggestedQuestions: data.content.suggestedQuestions,
        identifiedDeity: data.content.identifiedDeity,
        greeting: data.content.greeting,
        wikipediaSummary: data.content.wikipediaSummary,
        structureParts: data.content.structureParts,
        originalDescription: data.content.originalDescription,
        currentCondition: data.content.currentCondition
      },
      media: {
        uploadedImageURL: imageUrl,
        wikiThumbnail: data.media.wikiThumbnail
      },
      meta: {
        languageUsed: data.meta.languageUsed,
        timeSpent: data.meta.timeSpent,
        timestamp: serverTimestamp(),
        imageHash: data.meta.imageHash
      }
    };

    const docRef = await addDoc(collection(firestore, 'user_history'), historyDoc);
    return docRef.id;
  } catch (error) {
    console.error("Error saving history:", error);
    throw error;
  }
}

export async function updateUserHistory(docId: string, data: any) {
  if (!auth.currentUser) return;

  try {
    const docRef = doc(firestore, 'user_history', docId);
    const updateData: any = {};
    
    if (data.content) {
      if (data.content.fullStoryText) updateData['content.fullStoryText'] = data.content.fullStoryText;
      if (data.content.fullMythologyText) updateData['content.fullMythologyText'] = data.content.fullMythologyText;
      if (data.content.wikipediaSummary) updateData['content.wikipediaSummary'] = data.content.wikipediaSummary;
      if (data.content.structureParts) updateData['content.structureParts'] = data.content.structureParts;
      if (data.content.originalDescription) updateData['content.originalDescription'] = data.content.originalDescription;
      if (data.content.currentCondition) updateData['content.currentCondition'] = data.content.currentCondition;
    }
    
    if (data.media?.wikiThumbnail) updateData['media.wikiThumbnail'] = data.media.wikiThumbnail;

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error("Error updating history:", error);
    throw error;
  }
}

export async function checkHistoryCache(uid: string, hash: string) {
  try {
    const q = query(
      collection(firestore, 'user_history'),
      where('user.uid', '==', uid),
      where('meta.imageHash', '==', hash),
      orderBy('meta.timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs[0].data();
    }
    return null;
  } catch (error) {
    console.error("Cache check failed", error);
    return null;
  }
}

export { onAuthStateChanged };
export type { User };
