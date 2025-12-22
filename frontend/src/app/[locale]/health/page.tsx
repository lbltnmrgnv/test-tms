import { getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import HealthPage from './HealthPage';
import { PageType } from '@/types/base';
import { LocaleCodeType } from '@/types/locale';
import { HealthMessages } from '@/types/health';

export async function generateMetadata({ params: { locale } }: { params: { locale: LocaleCodeType } }) {
  const t = await getTranslations({ locale, namespace: 'Health' });
  return {
    title: `${t('health_check')} | TestTCMS`,
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: PageType) {
  const t = useTranslations('Health');
  const messages: HealthMessages = {
    health_check: t('health_check'),
    status: t('status'),
    ok: t('ok'),
    error: t('error'),
    api_server: t('api_server'),
    testtcms_version: t('testtcms_version'),
  };

  return (
    <div className="w-full flex items-center justify-center">
      <HealthPage messages={messages} locale={params.locale as LocaleCodeType} />
    </div>
  );
}
