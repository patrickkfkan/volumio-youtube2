#### Guide to setting up Google API credentials

1. Go to your [Google Developers Console](https://console.developers.google.com)

2. Create a Project (click 'Select a Project', then 'New Project').

3. On the left menu, choose 'Library', then enter "YouTube Data API v3" in the search box. In the search results, choose the API and enable it.

4. Then, on the left menu, choose 'Credentials'. This is where you will create your API credentials.

5. Click 'Create Credentials' and choose 'API Key'. An API Key will be created and you can optionally choose to restrict it to the YouTube Data API v3.

6. Then click 'Create Credentials' again and choose 'OAuth client ID'.

7. You will be asked to configure the consent screen, so let’s do that. On the configuration page:

    - Set Application name (e.g. volumio-youtube-*your-username*). This name will be shown during the process where you grant Volumio access to your YouTube account.
    - Click 'Add scope', then check the box for 'YouTube Data API v3 …/auth/youtube.readonly'
    - Click 'Save'.
    - You will be brought back to the Create OAuth Client ID page.

8. Choose 'Other' for 'Application type' and provide a name (e.g. volumio-youtube-client).
9. Click 'Create'.

That's it! You have just created the API credentials needed for YouTube access. On the Credentials page, you will see the 'API key' and 'Client ID'. The 'Client Secret' can be obtained by clicking the 'Edit' icon for the Client ID.