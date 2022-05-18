describe('Test root clicker', () => {
  it('visits the app root url and test button functionality', () => {
    cy.visit('/')
    cy.contains('h1', 'This is the home page')
    cy.get('button').click()
    cy.contains('p', 'Clicked the button 1 times.')
    cy.contains('p', 'Double this value is 2.')
  })
})
