import { useTranslation } from 'react-i18next'
import LegalLayout, { LegalSection } from './LegalLayout'

export default function Privacy() {
  const { t } = useTranslation()
  return (
    <LegalLayout title={t('privacy.title')} updated={t('privacy.updated')}>
      <p>{t('privacy.intro')}</p>

      <LegalSection no={1} title={t('privacy.s1Title')}>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>{t('privacy.s1AccountLabel')}</strong>
            {t('privacy.s1Account')}
          </li>
          <li>
            <strong>{t('privacy.s1InputLabel')}</strong>
            {t('privacy.s1Input')}
          </li>
          <li>
            <strong>{t('privacy.s1AiLabel')}</strong>
            {t('privacy.s1Ai')}
          </li>
          <li>
            <strong>{t('privacy.s1PayLabel')}</strong>
            {t('privacy.s1PayPre')}
            <strong>{t('privacy.s1PayStrong')}</strong>
            {t('privacy.s1PayPost')}
          </li>
          <li>
            <strong>{t('privacy.s1AnalyticsLabel')}</strong>
            {t('privacy.s1AnalyticsPre')}
            <strong>{t('privacy.s1AnalyticsStrong')}</strong>
            {t('privacy.s1AnalyticsPost')}
          </li>
        </ul>
      </LegalSection>

      <LegalSection no={2} title={t('privacy.s2Title')}>
        <p>
          {t('privacy.s2Pre')}
          <strong>{t('privacy.s2Strong')}</strong>
          {t('privacy.s2Post')}
        </p>
      </LegalSection>

      <LegalSection no={3} title={t('privacy.s3Title')}>
        <p>{t('privacy.s3Body')}</p>
      </LegalSection>

      <LegalSection no={4} title={t('privacy.s4Title')}>
        <p>{t('privacy.s4Body')}</p>
      </LegalSection>

      <LegalSection no={5} title={t('privacy.s5Title')}>
        <p>{t('privacy.s5Body')}</p>
      </LegalSection>

      <LegalSection no={6} title={t('privacy.s6Title')}>
        <p>{t('privacy.s6Body')}</p>
      </LegalSection>

      <LegalSection no={7} title={t('privacy.s7Title')}>
        <p>{t('privacy.s7Body')}</p>
      </LegalSection>

      <LegalSection no={8} title={t('privacy.s8Title')}>
        <p>
          {t('privacy.s8Pre')} <strong>privacy@ntk-platform.example</strong>
          {t('privacy.s8Post')}
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
