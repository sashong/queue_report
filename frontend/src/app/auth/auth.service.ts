import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private firebaseConfig = {
    apiKey: 'AIzaSyAeaYHkue2pxh6kDyTL8w6CSaF9LNbMZHc',
    authDomain: 'starlabs-test.firebaseapp.com',
    projectId: 'starlabs-test'
  };

  private app = initializeApp(this.firebaseConfig);
  private auth = getAuth(this.app);

  private currentUser: User | null = null;

  constructor() {
    onAuthStateChanged(this.auth, user => {
      this.currentUser = user;
    });
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout() {
    return signOut(this.auth);
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  getUser(): User | null {
    return this.currentUser;
  }
}
