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

let userTokens = null;

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/tasks'
  ];
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
    if (tokens.refresh_token) {
      oauth2Client.setCredentials(tokens);
    }
    res.send(`
      <div style="font-family:sans-serif; padding:20px;">
        <h2>Autenticazione riuscita!</h2>
        <p>Copia questo <b>refresh_token</b> e incollalo nelle variabili d'ambiente di Render col nome <b>GOOGLE_REFRESH_TOKEN</b>:</p>
        <textarea style="width:100%; height:100px; font-family:monospace;">${tokens.refresh_token || 'Token già attivo o non rigenerato'}</textarea>
        <p>Fatto questo, la connessione non si interromperà più.</p>
      </div>
    `);
  } catch (error) {
    console.error('Errore callback:', error);
    res.status(500).send('Autenticazione fallita.');
  }
});

function getClient() {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return oauth2Client;
  }
  if (userTokens) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://mio-backend-calendar.onrender.com/api/auth/google/callback'
    );
    client.setCredentials(userTokens);
    return client;
  }
  return null;
}

app.get('/api/events', async (req, res) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(401).json({ error: 'Non autenticato' });
    }
    const calendar = google.calendar({ version: 'v3', auth: client });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: (new Date()).toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(response.data.items);
  } catch (error) {
    console.error('Errore eventi:', error);
    res.status(500).json({ error: 'Impossibile recuperare gli eventi' });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const client = getClient();
    if (!client) {
      return res.status(401).json({ error: 'Non autenticato' });
    }
    const service = google.tasks({ version: 'v1', auth: client });
    const listsResponse = await service.tasklists.list({ maxResults: 1 });
    const taskLists = listsResponse.data.items;
    
    if (!taskLists || taskLists.length === 0) {
      return res.json({ listTitle: 'Nessuna lista', items: [] });
    }

    const tasksResponse = await service.tasks.list({
      taskList: taskLists[0].id,
      showCompleted: true,
    });

    res.json({
      listTitle: taskLists[0].title,
      items: tasksResponse.data.items || []
    });
  } catch (error) {
    console.error('Errore task:', error);
    res.status(500).json({ error: 'Impossibile recuperare i task' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
