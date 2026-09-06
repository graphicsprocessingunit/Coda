import { createNavigationContainerRef } from '@react-navigation/native';

export type RootTabParamList = {
  Player: undefined;
  Library: undefined;
  Playlists: undefined;
  Settings: undefined;
};

export const navigationRef = createNavigationContainerRef<RootTabParamList>();