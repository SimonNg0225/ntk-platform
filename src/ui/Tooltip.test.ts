import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './index'

describe('Tooltip hover isolation', () => {
  it('uses a named group so parent card hover cannot reveal every tooltip', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        { className: 'group' },
        createElement(
          Tooltip,
          {
            label: '複製',
            children: createElement('button', { type: 'button' }, '動作'),
          },
        ),
      ),
    )

    expect(html).toContain('group/tooltip')
    expect(html).toContain('group-hover/tooltip:opacity-100')
    expect(html).toContain('group-focus-within/tooltip:opacity-100')
  })
})
