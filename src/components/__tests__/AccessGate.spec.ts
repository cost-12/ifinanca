import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccessGate from '../AccessGate.vue'
import { loginWithEmailProfile, signInWithGoogleProfile } from '@/services/firebase'

vi.mock('@/services/firebase', () => ({
  getFirebaseAuthErrorMessage: vi.fn(() => 'Erro de autenticacao'),
  isFirebaseConfigured: true,
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
}))

describe('AccessGate', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv('VITE_FIREBASE_APPCHECK_SITE_KEY', '')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    }))
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

  it('emits a profile after Google authentication', async () => {
    const wrapper = mount(AccessGate, { props: { language: 'pt-BR' } })

    await wrapper.findAll('button').find((button) => button.text().includes('Continuar com Google'))!.trigger('click')
    await flushPromises()

    expect(signInWithGoogleProfile).toHaveBeenCalledWith({
      goal: 'Organizar fluxo mensal',
      monthlyIncome: 8600,
    })
    expect(wrapper.emitted('authenticated')?.[0]?.[0]).toMatchObject({
      name: 'Thiago Google',
      email: 'thiago.google@example.com',
    })
  })
})
