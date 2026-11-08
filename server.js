const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://mio-backend-calendar.onrender.com/api/auth/google/callback'
);

// Se abbiamo salvato il token permanente su Render, lo carichiamo subito
if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

// Rotta per stampare il token la prima volta (ti serve per prenderlo)
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
    
    // Mostra il refresh token a schermo così puoi copiarlo
    res.send(`
      <div style="font-family:sans-serif; padding:20px;">
        <h2>Autenticazione riuscita!</h2>
        <p>Copia questo <b>refresh_token</b> e incollalo nelle variabili d'ambiente di Render col nome <b>GOOGLE_REFRESH_TOKEN</b>:</p>
        <textarea style="width:100%; height:100px;">${tokens.refresh_token || 'Token già esistente o non rigenerato (prova a fare il revoca permessi su Google se non lo vedi)'}</textarea>
      </div>
    `);
  } catch (error) {
    res.status(500).send('Autenticazione fallita.');
  }
});

app.get('/api/events', async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Impossibile recuperare gli eventi. Controlla il refresh token.' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
