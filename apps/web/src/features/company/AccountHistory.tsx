import { Panel, Table } from '../../shared/ui';
import { formatAmount, statementNames, type CvmObservation } from './financialPresentation';

type Account = CvmObservation['accounts'][number];

function accountRows(observations: CvmObservation[]) {
  const rows = new Map<string, { account: Account; hasVariableCode: boolean }>();

  for (const observation of observations) {
    for (const account of observation.accounts) {
      const row = rows.get(account.key);

      if (!row) {
        rows.set(account.key, { account, hasVariableCode: false });
      } else if (account.code !== row.account.code || account.statement !== row.account.statement) {
        row.hasVariableCode = true;
      }
    }
  }

  return [...rows.values()];
}

export function AccountHistory({ observations }: { observations: CvmObservation[] }) {
  const rows = accountRows(observations);
  const accountsByPeriod = observations.map((observation) => ({
    referenceDate: observation.referenceDate,
    accounts: new Map(observation.accounts.map((account) => [account.key, account])),
  }));

  return (
    <Panel className="company-panel" aria-labelledby="company-history">
      <div>
        <h2 id="company-history">Contas por exercício</h2>
        <p id="company-history-note">
          Demonstrações consolidadas em reais (R$). Deslize ou use as setas para ver as demais
          colunas em telas estreitas.
        </p>
      </div>
      {rows.length === 0 ? (
        <p>As contas consolidadas desta companhia estão indisponíveis.</p>
      ) : (
        <div
          className="company-table-scroll"
          role="region"
          aria-labelledby="company-history"
          aria-describedby="company-history-note"
          tabIndex={0}
        >
          <Table className="company-history-table" aria-labelledby="company-history">
            <thead>
              <tr>
                <th scope="col">Conta CVM</th>
                {observations.map((observation) => (
                  <th key={observation.referenceDate} scope="col">
                    {observation.fiscalYear}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, hasVariableCode }) => (
                <tr key={account.key}>
                  <th scope="row">
                    {account.label}
                    {hasVariableCode ? (
                      <small>Código por exercício</small>
                    ) : (
                      <small title={statementNames[account.statement]}>
                        {account.statement} · {account.code}
                      </small>
                    )}
                  </th>
                  {accountsByPeriod.map(({ referenceDate, accounts }) => {
                    const periodAccount = accounts.get(account.key);

                    return (
                      <td key={referenceDate}>
                        {periodAccount?.amountBrl == null ? (
                          <span className="company-unavailable">Indisponível</span>
                        ) : (
                          <>
                            {formatAmount(periodAccount.amountBrl)}
                            {hasVariableCode && (
                              <small title={statementNames[periodAccount.statement]}>
                                {periodAccount.statement} · {periodAccount.code}
                              </small>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
