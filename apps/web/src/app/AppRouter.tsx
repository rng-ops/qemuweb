import { RouterProvider } from 'react-router-dom';
import { router } from './routes';

/**
 * Main application component using React Router.
 * This provides the new SonarQube-style navigation.
 */
export function AppRouter() {
  return <RouterProvider router={router} />;
}

export default AppRouter;
