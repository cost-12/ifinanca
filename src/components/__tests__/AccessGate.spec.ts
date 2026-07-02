import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccessGate from '../AccessGate.vue'
import {
  ensureAppCheckReady,
  getAppCheckErrorMessage,
  getAppCheckSiteKey,
  loginWithEmailProfile,
  retryAppCheckWarmUp,
  signInWithGoogleProfile,
  warmUpAppCheck,
} from '@/services/firebase'

vi.mock('@/services/firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/firebase')>()

  return {
    ...actual,
    getFirebaseAuthErrorMessage: vi.fn(() => 'Erro de autenticacao'),
    isFirebaseConfigured: true,
    getAppCheckSiteKey: vi.fn(() => ''),
    warmUpAppCheck: vi.fn().mockResolvedValue('disabled'),
    retryAppCheckWarmUp: vi.fn().mockResolvedValue('ready'),
    ensureAppCheckReady: vi.fn().mockResolvedValue(undefined),
    getAppCheckErrorMessage: vi.fn(() => 'Falha na verificacao de seguranca'),
    loginWithEmailProfile: vi.fn().mockResolvedValue({
      id: 'user-2',
      name: 'Thiago Costa',
      email: 'thiago@example.com',
      goal: 'Unificar bancos',
      monthlyIncome: 9000,
      createdAt: '2026-07-01T00:00:00.000Z',
    }),
    registerWithEmailProfile: vi.fn().mockResolvedValue({
      profile: {
        id: 'user-1',
        name: 'Thiago Costa',
        email: 'thiago@example.com',
        goal: 'Organizar fluxo mensal',
        monthlyIncome: 8600,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
      emailVerificationSent: true,
    }),
    sendLoginPasswordReset: vi.fn(),
    signInWithGoogleProfile: vi.fn().mockResolvedValue({
      id: 'google-user',
      name: 'Thiago Google',
      email: 'thiago.google@example.com',
      goal: 'Organizar fluxo mensal',
      monthlyIncome: 8600,
      createdAt: '2026-07-01T00:00:00.000Z',
    }),
  }
})

describe('AccessGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppCheckSiteKey).mockReturnValue('')
    vi.mocked(warmUpAppCheck).mockResolvedValue('disabled')
    vi.mocked(ensureAppCheckReady).mockResolvedValue(undefined)
    vi.mocked(signInWithGoogleProfile).mockResolvedValue({
      id: 'google-user',
      name: 'Thiago Google',
      email: 'thiago.google@example.com',
      goal: 'Organizar fluxo mensal',
      monthlyIncome: 8600,
      createdAt: '2026-07-01T00:00:00.000Z',
    })
  })

  it('keeps the user on the access screen after registration until email verification', async () => {
    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })

    await wrapper.get('input[type="text"]').setValue('Thiago Costa')
    await wrapper.get('input[type="email"]').setValue('thiago@example.com')
    const passwordInputs = wrapper.findAll('input[type="password"]')

    expect(passwordInputs).toHaveLength(2)

    await passwordInputs[0]!.setValue('senha123')
    await passwordInputs[1]!.setValue('senha123')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('authenticated')).toBeUndefined()
    expect(wrapper.text()).toContain('link de verificacao')
    expect(wrapper.text()).toContain('Entre na sua conta')
  })

  it('emits a profile after a verified login', async () => {
    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })
    const loginButton = wrapper.findAll('button').find((button) => button.text() === 'Entrar')

    expect(loginButton).toBeTruthy()

    await loginButton!.trigger('click')
    await wrapper.get('input[type="email"]').setValue('thiago@example.com')
    await wrapper.get('input[type="password"]').setValue('senha123')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(loginWithEmailProfile).toHaveBeenCalledWith({
      email: 'thiago@example.com',
      password: 'senha123',
    })
    expect(wrapper.emitted('authenticated')?.[0]?.[0]).toMatchObject({
      name: 'Thiago Costa',
      email: 'thiago@example.com',
      goal: 'Unificar bancos',
    })
  })

  it('warms up App Check on mount when configured', async () => {
    vi.mocked(getAppCheckSiteKey).mockReturnValue('site-key')
    vi.mocked(warmUpAppCheck).mockResolvedValue('ready')

    mount(AccessGate, { props: { language: 'pt-BR' } })
    await flushPromises()

    expect(warmUpAppCheck).toHaveBeenCalledTimes(1)
  })

  it('emits a profile after Google authentication without manual reCAPTCHA', async () => {
    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })

    await wrapper.findAll('button').find((button) => button.text().includes('Continuar com Google'))!.trigger('click')
    await flushPromises()

    expect(ensureAppCheckReady).not.toHaveBeenCalled()
    expect(signInWithGoogleProfile).toHaveBeenCalledWith({
      goal: 'Organizar fluxo mensal',
      monthlyIncome: 8600,
    })
    expect(wrapper.emitted('authenticated')?.[0]?.[0]).toMatchObject({
      name: 'Thiago Google',
      email: 'thiago.google@example.com',
    })
  })

  it('requires App Check before Google authentication when configured', async () => {
    vi.mocked(getAppCheckSiteKey).mockReturnValue('site-key')
    vi.mocked(warmUpAppCheck).mockResolvedValue('ready')

    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('Continuar com Google'))!.trigger('click')
    await flushPromises()

    expect(ensureAppCheckReady).toHaveBeenCalledTimes(1)
    expect(signInWithGoogleProfile).toHaveBeenCalledTimes(1)
  })

  it('shows an App Check error when Google authentication is blocked by security verification', async () => {
    vi.mocked(getAppCheckSiteKey).mockReturnValue('site-key')
    vi.mocked(warmUpAppCheck).mockResolvedValue('ready')
    vi.mocked(ensureAppCheckReady).mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'app-check/timeout' }),
    )

    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })
    await flushPromises()

    await wrapper.findAll('button').find((button) => button.text().includes('Continuar com Google'))!.trigger('click')
    await flushPromises()

    expect(getAppCheckErrorMessage).toHaveBeenCalledWith('pt-BR')
    expect(wrapper.text()).toContain('Falha na verificacao de seguranca')
    expect(wrapper.emitted('authenticated')).toBeUndefined()
  })

  it('retries App Check warm-up from the error state', async () => {
    vi.mocked(getAppCheckSiteKey).mockReturnValue('site-key')
    vi.mocked(warmUpAppCheck).mockResolvedValue('error')
    vi.mocked(retryAppCheckWarmUp).mockResolvedValue('ready')

    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })
    await flushPromises()

    const retryButton = wrapper.findAll('button').find((button) => button.text().includes('Tentar novamente'))
    expect(retryButton).toBeTruthy()

    await retryButton!.trigger('click')
    await flushPromises()

    expect(retryAppCheckWarmUp).toHaveBeenCalledTimes(1)
  })
})
