// Auto-generated from ./src/UIConfig.json

import type { UIConfigButton, UIConfigInput, UIConfigSelect, UIConfigSwitch } from "./UIConfig";
export type UIConfigSectionKey = 
              'section_disclaimer' | 
              'section_i18n' | 
              'section_account' | 
              'section_browse' | 
              'section_playback' | 
              'section_yt_playback_mode' | 
              'section_yt_dlp';

export type UIConfigSectionContentKeyOf<K extends UIConfigSectionKey> =
  K extends 'section_disclaimer' ?
    'viewDisclaimer' | 
    'hasAcceptedDisclaimer' | 
    'projectHome' :

  K extends 'section_i18n' ?
    'region' | 
    'language' :

  K extends 'section_account' ?
    'cookie' | 
    'activeChannelHandle' | 
    'cookieGuide' :

  K extends 'section_browse' ?
    'rootContentType' | 
    'loadFullPlaylists' :

  K extends 'section_playback' ?
    'autoplay' | 
    'autoplayClearQueue' | 
    'autoplayPrefMixRelated' | 
    'addToHistory' | 
    'liveStreamQuality' | 
    'prefetch' :

  K extends 'section_yt_playback_mode' ?
    'feedVideos' | 
    'playlistVideos' :

  K extends 'section_yt_dlp' ?
    'useYtDlp' | 
    'ytDlpVersion' | 
    'installLatestYtDlp' :

  never;

export type UIConfigElementOf<K extends UIConfigSectionKey, C extends UIConfigSectionContentKeyOf<K>> =
  K extends 'section_disclaimer' ? (
    C extends 'viewDisclaimer' ? UIConfigButton<K> :
    C extends 'hasAcceptedDisclaimer' ? UIConfigSwitch<K> :
    C extends 'projectHome' ? UIConfigButton<K> :
    never
  ) : 

  K extends 'section_i18n' ? (
    C extends 'region' ? UIConfigSelect<K> :
    C extends 'language' ? UIConfigSelect<K> :
    never
  ) : 

  K extends 'section_account' ? (
    C extends 'cookie' ? UIConfigInput<K, 'text'> :
    C extends 'activeChannelHandle' ? UIConfigSelect<K> :
    C extends 'cookieGuide' ? UIConfigButton<K> :
    never
  ) : 

  K extends 'section_browse' ? (
    C extends 'rootContentType' ? UIConfigSelect<K> :
    C extends 'loadFullPlaylists' ? UIConfigSwitch<K> :
    never
  ) : 

  K extends 'section_playback' ? (
    C extends 'autoplay' ? UIConfigSwitch<K> :
    C extends 'autoplayClearQueue' ? UIConfigSwitch<K> :
    C extends 'autoplayPrefMixRelated' ? UIConfigSwitch<K> :
    C extends 'addToHistory' ? UIConfigSwitch<K> :
    C extends 'liveStreamQuality' ? UIConfigSelect<K> :
    C extends 'prefetch' ? UIConfigSwitch<K> :
    never
  ) : 

  K extends 'section_yt_playback_mode' ? (
    C extends 'feedVideos' ? UIConfigSwitch<K> :
    C extends 'playlistVideos' ? UIConfigSwitch<K> :
    never
  ) : 

  K extends 'section_yt_dlp' ? (
    C extends 'useYtDlp' ? UIConfigSwitch<K> :
    C extends 'ytDlpVersion' ? UIConfigSelect<K> :
    C extends 'installLatestYtDlp' ? UIConfigButton<K> :
    never
  ) : 

  never;

