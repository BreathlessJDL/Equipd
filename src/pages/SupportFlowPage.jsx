import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SupportArticlesStep,
  SupportCategoryStep,
  SupportContactForm,
  SupportFlowHeader,
  SupportIssueStep,
  SupportSuccess,
} from '../components/support/SupportFlowSteps'
import '../components/support/SupportFlow.css'
import {
  SUPPORT_FLOW_CATEGORIES,
  getRecommendedSupportArticles,
  getSupportFlowCategory,
  getSupportFlowIssue,
} from '../data/supportFlow'
import { useAuth } from '../hooks/useAuth'
import { usePageTitle } from '../hooks/usePageTitle'
import { getGeneralSupportErrorMessage, submitGeneralSupportInquiry } from '../lib/generalSupport'
import { fetchProfile } from '../lib/profiles'

function SupportFlowPage() {
  usePageTitle('Support')
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [categoryId, setCategoryId] = useState('')
  const [issueId, setIssueId] = useState('')
  const [showContactForm, setShowContactForm] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })

  const category = useMemo(() => getSupportFlowCategory(categoryId), [categoryId])
  const issue = useMemo(
    () => getSupportFlowIssue(categoryId, issueId),
    [categoryId, issueId],
  )
  const articles = useMemo(
    () => getRecommendedSupportArticles(categoryId, issueId),
    [categoryId, issueId],
  )

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step, showContactForm, resolved, submitted])

  useEffect(() => {
    let active = true

    async function prefillForm() {
      if (!user) return

      const next = {
        email: user.email ?? '',
        name: '',
      }

      const { data: profile } = await fetchProfile(user.id)
      if (!active) return

      if (profile?.display_name?.trim()) {
        next.name = profile.display_name.trim()
      }

      setForm((current) => ({
        ...current,
        name: current.name || next.name,
        email: current.email || next.email,
      }))
    }

    prefillForm()

    return () => {
      active = false
    }
  }, [user])

  function handleBack() {
    setError('')

    if (submitted || resolved) {
      setSubmitted(false)
      setResolved(false)
      setShowContactForm(false)
      setStep(3)
      return
    }

    if (showContactForm) {
      setShowContactForm(false)
      return
    }

    if (step === 3) {
      setIssueId('')
      setStep(2)
      return
    }

    if (step === 2) {
      setCategoryId('')
      setStep(1)
    }
  }

  function handleCategorySelect(nextCategoryId) {
    setCategoryId(nextCategoryId)
    setIssueId('')
    setShowContactForm(false)
    setResolved(false)
    setSubmitted(false)
    setStep(2)
  }

  function handleIssueSelect(nextIssueId) {
    setIssueId(nextIssueId)
    setShowContactForm(false)
    setResolved(false)
    setSubmitted(false)
    setStep(3)
  }

  function handleFormChange(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!category || !issue || submitting) return

    setSubmitting(true)
    setError('')

    const { error: submitError } = await submitGeneralSupportInquiry({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
      category: category.title,
      subcategory: issue.title,
    })

    if (submitError) {
      setError(getGeneralSupportErrorMessage(submitError))
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  let title = 'Contact Support'
  let subtitle = 'What can we help you with today?'

  if (step === 2 && category) {
    subtitle = category.title
  }

  if (step === 3 && category && issue) {
    subtitle = showContactForm ? 'Tell us more and we will get back to you.' : 'Suggested articles'
  }

  return (
    <div className="support-flow">
      <div className="support-flow__inner">
        <SupportFlowHeader
          step={step}
          title={title}
          subtitle={subtitle}
          onBack={handleBack}
          showBack={step > 1 || showContactForm || resolved || submitted}
        />

        {resolved ? (
          <SupportSuccess
            title="Glad we could help"
            message="Thanks for using the Help Centre. You can return any time if you have more questions."
            actionLabel="Back to Help Centre"
            actionTo="/help"
          />
        ) : submitted ? (
          <SupportSuccess
            title="Message sent"
            message="Thanks for contacting Equipd support. We have received your message and will get back to you by email."
            actionLabel="Back to Help Centre"
            actionTo="/help"
          />
        ) : step === 1 ? (
          <SupportCategoryStep
            categories={SUPPORT_FLOW_CATEGORIES}
            onSelect={handleCategorySelect}
          />
        ) : step === 2 && category ? (
          <SupportIssueStep category={category} onSelect={handleIssueSelect} />
        ) : step === 3 && category && issue ? (
          showContactForm ? (
            <>
              <h2 className="support-flow__section-title">Contact Support</h2>
              <SupportContactForm
                category={category}
                issue={issue}
                name={form.name}
                email={form.email}
                subject={form.subject}
                message={form.message}
                submitting={submitting}
                error={error}
                onChange={handleFormChange}
                onSubmit={handleSubmit}
              />
            </>
          ) : (
            <SupportArticlesStep
              category={category}
              issue={issue}
              articles={articles}
              onSolved={() => setResolved(true)}
              onNeedHelp={() => {
                setError('')
                setShowContactForm(true)
              }}
            />
          )
        ) : (
          <p className="support-flow__error">
            Something went wrong with this support path.{' '}
            <Link to="/support">Start again</Link>.
          </p>
        )}
      </div>
    </div>
  )
}

export default SupportFlowPage
