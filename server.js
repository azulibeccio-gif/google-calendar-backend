// Rotta per aggiungere un nuovo evento a Google Calendar
app.use(express.json()); // Necessario per leggere i dati inviati in formato JSON

app.post('/api/add-event', async (req, res) => {
  try {
    if (!userTokens) {
      return res.status(401).json({ error: 'Prima devi effettuare il login andando su /auth/google' });
    }

    oauth2Client.setCredentials(userTokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Dati inviati dalla dashboard (es. titolo, data inizio, data fine)
    const { summary, description, startDateTime, endDateTime } = req.body;

    const event = {
      summary: summary || 'Nuovo evento da Dashboard',
      description: description || '',
      start: {
        dateTime: startDateTime || new Date().toISOString(),
        timeIso: 'Europe/Rome',
      },
      end: {
        dateTime: endDateTime || new Date(Date.now + 3600000).toISOString(), // 1 ora di default
        timeIso: 'Europe/Rome',
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({ success: true, message: 'Evento aggiunto con successo!', event: response.data });
  } catch (error) {
    console.error('Errore durante la creazione dell\'evento:', error);
    res.status(500).json({ error: 'Impossibile aggiungere l\'evento a Google Calendar' });
  }
});
