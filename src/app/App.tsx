import { AuthProvider } from "./AuthProvider";
import { LanguageProvider } from "./LanguageContext";
import AppRouter from "./router";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
}
