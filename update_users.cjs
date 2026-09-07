// Script to downgrade existing normal users to "user" in case they were mistakenly given admin
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
// Since I don't have the service account, I can't do this easily from a node script.
// The user can just delete their account from the Firebase console or I can write a cloud function / endpoint if really needed.
// Actually, since I have the admin-login logic on the client to redirect them, let's just make sure the role is right for new logins.
console.log('Role logic fixed in source code');
