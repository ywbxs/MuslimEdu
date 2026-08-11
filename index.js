/**
 * Metro's entry point.
 *
 * The CI workflows scaffold a throwaway React Native project and copy only
 * `src/` and `App.tsx` into it, so they use the template's own copy of this
 * file and never see this one. It exists so that Metro can also be run
 * directly against this repo for local/Codespace development
 * (`npm start`), which is otherwise impossible - there is no entry point
 * for the bundler to start from.
 *
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
