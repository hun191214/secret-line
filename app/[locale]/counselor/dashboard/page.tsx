import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function MinimalPage({ params }: Props) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="p-10">Dashboard Ready</div>
    </NextIntlClientProvider>
  );
}
