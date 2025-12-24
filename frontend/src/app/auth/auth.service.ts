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

  private readonly LOGIN_KEY = 'isLoggedIn';

    login() {
    if (typeof window !== 'undefined') {
        localStorage.setItem(this.LOGIN_KEY, 'true');
    }
    }

    logout() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(this.LOGIN_KEY);
    }
    }


    isLoggedIn(): boolean {
    if (typeof window === 'undefined') {
        return false; 
    }
    return localStorage.getItem(this.LOGIN_KEY) === 'true';
    }


  getUser(): User | null {
    return this.currentUser;
  }
}
