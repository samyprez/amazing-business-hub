import RawPage from '@/components/RawPage';
import { markup, script } from '@/content/home';

export default function Home() {
  return <RawPage markup={markup} script={script} />;
}
