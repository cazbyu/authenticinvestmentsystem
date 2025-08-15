import { LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['en-short'] = {
  ...LocaleConfig.locales['en'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

LocaleConfig.defaultLocale = 'en-short';
