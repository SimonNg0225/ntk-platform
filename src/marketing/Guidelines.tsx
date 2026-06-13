import { useTranslation } from 'react-i18next'
import LegalLayout, { LegalSection } from './LegalLayout'

// 社群守則（資源分享區 + 老師社群論壇）。構成《服務條款》一部分。
export default function Guidelines() {
  const { t } = useTranslation()
  return (
    <LegalLayout title={t('guidelines.title')} updated={t('guidelines.updated')}>
      <p>{t('guidelines.intro')}</p>

      <LegalSection no={1} title={t('guidelines.s1Title')}>
        <p>{t('guidelines.s1Body')}</p>
      </LegalSection>
      <LegalSection no={2} title={t('guidelines.s2Title')}>
        <p>{t('guidelines.s2Body')}</p>
      </LegalSection>
      <LegalSection no={3} title={t('guidelines.s3Title')}>
        <p>{t('guidelines.s3Body')}</p>
      </LegalSection>
      <LegalSection no={4} title={t('guidelines.s4Title')}>
        <p>{t('guidelines.s4Body')}</p>
      </LegalSection>
      <LegalSection no={5} title={t('guidelines.s5Title')}>
        <p>{t('guidelines.s5Body')}</p>
      </LegalSection>
      <LegalSection no={6} title={t('guidelines.s6Title')}>
        <p>{t('guidelines.s6Body')}</p>
      </LegalSection>
      <LegalSection no={7} title={t('guidelines.s7Title')}>
        <p>{t('guidelines.s7Body')}</p>
      </LegalSection>
      <LegalSection no={8} title={t('guidelines.s8Title')}>
        <p>{t('guidelines.s8Body')}</p>
      </LegalSection>
      <LegalSection no={9} title={t('guidelines.s9Title')}>
        <p>{t('guidelines.s9Body')}</p>
      </LegalSection>
    </LegalLayout>
  )
}
