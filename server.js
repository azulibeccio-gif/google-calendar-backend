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

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });
}

// Richiediamo i permessi sia per Calendar che per Google Tasks
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
    res.send(`
      <div style="font-family:sans-serif; padding:20px;">
        <h2>Autenticazione riuscita!</h2>
        <p>Copia questo <b>refresh_token</b> e incollalo nelle variabili d'ambiente di Render col nome <b>GOOGLE_REFRESH_TOKEN</b> (se non lo hai già fatto):</p>
        <textarea style="width:100%; height:100px;">${tokens.refresh_token || 'Token già attivo'}</textarea>
      </div>
    `);
  } catch (error) {
    res.status(500).send('Autenticazione fallita.');
  }
});

// Endpoint per gli eventi del Calendario
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
    res.status(500).json({ error: 'Impossibile recuperare gli eventi' });
  }
});

// Nuovo Endpoint per Google Tasks (richiesto da Canva per le checklist)
app.get('/api/tasks', async (req, res) => {
  try {
    const service = google.tasks({ version: 'v1', auth: oauth2Client });
    
    // Prima otteniamo la lista dei task predefinita o la prima disponibile
    const listsResponse = await service.tasklists.list({ maxResults: 1 });
    const taskLists = listsResponse.data.items;
    
    if (!taskLists || taskLists.length === 0) {
      return res.json([]);
    }

    const taskListId = taskLists[0].id;

    // Recuperiamo i task all'interno di quell'elenco
    const tasksResponse = await service.tasks.list({
      taskList: taskListId,
      showCompleted: true,
    });

    res.json({
      listTitle: taskLists[0].title,
      items: tasksResponse.data.items || []
    });
  } catch (error) {
    console.error('Errore nel recupero dei task:', error);
    res.status(500).json({ error: 'Impossibile recuperare i task' });
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});
