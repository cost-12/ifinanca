import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import AccessGate from '../AccessGate.vue'

vi.mock('@/services/firebase', () => ({
  saveLead: vi.fn().mockResolvedValue({ mode: 'local' }),
}))

describe('AccessGate', () => {
  it('emits a profile after a valid signup', async () => {
    const wrapper = mount(AccessGate)

    await wrapper.get('input[type="text"]').setValue('Thiago Costa')
    await wrapper.get('input[type="email"]').setValue('thiago@example.com')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.emitted('registered')?.[0]?.[0]).toMatchObject({
      name: 'Thiago Costa',
      email: 'thiago@example.com',
      goal: 'Organizar fluxo mensal',
    })
  })
})
