import { useTranslation } from 'react-i18next'
import LegalLayout, { LegalSection } from './LegalLayout'

export default function Terms() {
  const { t } = useTranslation()
  return (
    <LegalLayout title={t('terms.title')} updated={t('terms.updated')}>
      <p>{t('terms.intro')}</p>

      <LegalSection no={1} title={t('terms.s1Title')}>
        <p>{t('terms.s1Body')}</p>
      </LegalSection>

      <LegalSection no={2} title={t('terms.s2Title')}>
        <p>{t('terms.s2Body')}</p>
      </LegalSection>

      <LegalSection no={3} title={t('terms.s3Title')}>
        <p>{t('terms.s3Body')}</p>
      </LegalSection>

      <LegalSection no={4} title={t('terms.s4Title')}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('terms.s4Item1')}</li>
          <li>{t('terms.s4Item2')}</li>
          <li>{t('terms.s4Item3')}</li>
          <li>{t('terms.s4Item4')}</li>
        </ul>
      </LegalSection>

      <LegalSection no={5} title={t('terms.s5Title')}>
        <p>{t('terms.s5Body')}</p>
      </LegalSection>

      <LegalSection no={6} title={t('terms.s6Title')}>
        <p>{t('terms.s6Body')}</p>
      </LegalSection>

      <LegalSection no={7} title={t('terms.s7Title')}>
        <p>{t('terms.s7Body')}</p>
      </LegalSection>

      <LegalSection no={8} title={t('terms.s8Title')}>
        <p>{t('terms.s8Body')}</p>
      </LegalSection>

      <LegalSection no={9} title={t('terms.s9Title')}>
        <p>{t('terms.s9Body')}</p>
      </LegalSection>

      <LegalSection no={10} title={t('terms.s10Title')}>
        <p>{t('terms.s10Body')}</p>
      </LegalSection>

      <LegalSection no={11} title={t('terms.s11Title')}>
        <p>{t('terms.s11Body')}</p>
      </LegalSection>

      <LegalSection no={12} title={t('terms.s12Title')}>
        <p>
          {t('terms.s12Pre')} <strong>support@eziteach.example</strong>
          {t('terms.s12Post')}
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
