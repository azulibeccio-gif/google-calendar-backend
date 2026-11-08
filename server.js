const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Abilita le richieste esterne da Canva/browser
app.use(cors());
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://mio-backend-calendar.onrender.com/api/auth/google/callback'
);

let userTokens = null;

app.get('/auth/google', (req, res) => {
  const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.send('Autenticazione riuscita con successo! Puoi chiudere questa pagina.');
  } catch (error) {
    res.status(500).send('Autenticazione fallita.');
  }
});

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

    res.json(response.data.items);
  } catch (error) {
    console.error('Errore nel recupero eventi:', error);
    res.status(500).json({ error: 'Impossibile recuperare gli eventi' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
