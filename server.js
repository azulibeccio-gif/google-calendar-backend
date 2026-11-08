const express = require('express');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 3000;

// Configurazione OAuth2 con le variabili salvate su Render
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://mio-backend-calendar.onrender.com/api/auth/google/callback'
);

// Variabile temporanea per memorizzare i token dopo il login
let userTokens = null;

// Rotta iniziale per avviare il login
app.get('/auth/google', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

// Rotta di Callback chiamata da Google dopo il login
app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens; // Salviamo i token in memoria
    oauth2Client.setCredentials(tokens);
    
    res.send('Autenticazione con Google Calendar riuscita con successo! Ora puoi aprire la pagina degli eventi o collegarla alla tua app.');
  } catch (error) {
    console.error('Errore durante l\'autenticazione:', error);
    res.status(500).send('Autenticazione fallita.');
  }
});

// Rotta per recuperare gli eventi del calendario
app.get('/api/events', async (req, res) => {
  try {
    if (!userTokens) {
      return res.status(401).json({ error: 'Prima devi effettuare il login andando su /auth/google' });
    }

    oauth2Client.setCredentials(userTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    res.json(events); // Restituisce gli eventi in formato JSON
  } catch (error) {
    console.error('Errore nel recupero degli eventi:', error);
    res.status(500).json({ error: 'Impossibile recuperare gli eventi' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
