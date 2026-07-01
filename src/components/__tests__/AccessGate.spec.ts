import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccessGate from '../AccessGate.vue'

vi.mock('@/services/firebase', () => ({
  getFirebaseAuthErrorMessage: vi.fn(() => 'Erro de autenticacao'),
  isFirebaseConfigured: true,
  loginWithEmailProfile: vi.fn(),
  registerWithEmailProfile: vi.fn().mockResolvedValue({
    id: 'user-1',
    name: 'Thiago Costa',
    email: 'thiago@example.com',
    goal: 'Organizar fluxo mensal',
    monthlyIncome: 8600,
    createdAt: '2026-07-01T00:00:00.000Z',
  }),
  sendLoginPasswordReset: vi.fn(),
}))

describe('AccessGate', () => {
  it('emits a profile after a valid account registration', async () => {
    const wrapper = mount(AccessGate)

    await wrapper.get('input[type="text"]').setValue('Thiago Costa')
    await wrapper.get('input[type="email"]').setValue('thiago@example.com')
    const passwordInputs = wrapper.findAll('input[type="password"]')

    expect(passwordInputs).toHaveLength(2)

    await passwordInputs[0]!.setValue('senha123')
    await passwordInputs[1]!.setValue('senha123')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('authenticated')?.[0]?.[0]).toMatchObject({
      name: 'Thiago Costa',
      email: 'thiago@example.com',
      goal: 'Organizar fluxo mensal',
    })
  })
})
