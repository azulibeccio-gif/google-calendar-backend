const express = require('express');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 3000;

// Configurazione OAuth2 con le variabili salvate su Render
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://mio-backend-calendar.onrender.com/api/auth/google/callback' // Sostituisci con il tuo URL esatto se cambia
);

// Rotta iniziale per avviare il login
app.get('/auth/google', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  res.redirect(url);
});

// Rotta di Callback chiamata da Google dopo il login
app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Qui potrai reindirizzare l'utente o mostrare i dati a Canva
    res.send('Autenticazione con Google Calendar riuscita con successo! Puoi chiudere questa pagina.');
  } catch (error) {
    console.error('Errore durante l\'autenticazione:', error);
    res.status(500.send('Autenticazione fallita.'));
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
