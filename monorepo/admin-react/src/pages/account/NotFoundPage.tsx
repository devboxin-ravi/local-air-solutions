import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { EmptyState } from '@/components/common';
import { Button, Card } from '@/components/ui/primitives';

export default function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-xl">
      <EmptyState icon={Compass} title="Page not found" description="The page you’re looking for doesn’t exist or you don’t have access to it." action={<Button asChild><Link to={ROUTES.DASHBOARD}>Back to dashboard</Link></Button>} />
    </Card>
  );
}
