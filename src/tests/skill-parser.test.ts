import { parseSkillTextMany } from '@/core/skills/skill-parser'

describe('parseSkillTextMany', () => {
  it('parses a root skills array from JSON', () => {
    const skills = parseSkillTextMany(
      JSON.stringify({
        skills: [
          {
            id: 'custom.code-review',
            name: 'Code Review',
            promptTemplate: 'Review {{input}}',
            description: 'Review code',
          },
        ],
      }),
      'paste',
    )

    expect(skills).toHaveLength(1)
    expect(skills[0].id).toBe('custom.code-review')
    expect(skills[0].versions).toHaveLength(1)
  })

  it('rejects unsafe or invalid skill ids with a field-level error', () => {
    expect(() =>
      parseSkillTextMany(
        JSON.stringify({ id: '<script>', name: 'Bad', promptTemplate: 'Bad {{input}}' }),
        'paste',
      ),
    ).toThrow('skills[0].id 不合法')
  })
})
