import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const googleProvider = new GoogleAuthProvider();

export async function registerUser(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName });
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    displayName,
    createdAt: serverTimestamp(),
  });
  return user;
}

export async function loginUser(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function loginWithGoogle(): Promise<User> {
  const { user } = await signInWithPopup(auth, googleProvider);
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    createdAt: serverTimestamp(),
  }, { merge: true });
  return user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
