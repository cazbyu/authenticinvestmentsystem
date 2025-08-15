import { LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['en-short'] = {
  ...LocaleConfig.locales['en'],
  // Add this line
  dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};

LocaleConfig.defaultLocale = 'en-short';