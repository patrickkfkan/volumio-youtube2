#### Guide to setting up Google API credentials

1. Go to your [Google Developers Console](https://console.developers.google.com)

2. Create a Project (click 'Select a Project', then 'New Project').

3. On the left menu, choose 'Library', then enter "YouTube Data API v3" in the search box. In the search results, choose the API and enable it.

4. Then, on the left menu, choose 'Credentials'. This is where you will create your API credentials.

5. Click 'Create Credentials' and choose 'API Key'. An API Key will be created and you can optionally choose to restrict it to the YouTube Data API v3.

6. Then click 'Create Credentials' again and choose 'OAuth client ID'.

7. You will be asked to configure the OAuth consent screen, so let’s do that. Click 'Configure Consent Screen', then:

    - Choose 'External' for User Type, then click 'Create'.
    - Enter App Name (e.g. volumio-youtube-*your-username*) and provide your email address under 'User support email' and 'Developer contact information'. Then click 'Save and Continue'.
    - On the page that follows, click 'Add or Remove Scopes', then check the box for '.../auth/youtube.readonly' for YouTube Data API v3. Click 'Update', followed by 'Save and Continue'.
    - On the page that follows, click 'Add Users' and enter the email address for your YouTube account. Click 'Add', followed by 'Save and Continue'.
    - You have completed configuration of the OAuth consent screen. Click 'Back to Dashboard'.

8. On the left menu, choose 'Credentials'. Then click 'Create Credentials' and choose 'OAuth client ID'.

9. For 'Application type', choose 'TVs and Limited Input devices'. Click 'Create'.

That's it! You have just created the API credentials needed for YouTube access. You will be shown the Client ID and Client Secret upon completing step 9 above. If you need these values later on, you can go to the Credentials page and find the API Key and Client ID there. The Client Secret can be obtained by clicking the 'Edit' icon for the Client ID.