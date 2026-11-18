import { INDEX_CODES, type IndexCode } from '@moat/data-contracts';
import { useState } from 'react';
import { Button, ButtonLink, EmptyState, Input, PageHeader, Panel, Select } from '../../shared/ui';

const pageSizes = ['5', '10', '20', '30', '40', '50'] as const;
const defaultPageSize = '10';

export function ScreenerPage() {
  const [search, setSearch] = useState('');
  const [index, setIndex] = useState<IndexCode | ''>('');
  const [pageSize, setPageSize] = useState<string>(defaultPageSize);
  const hasFilters = search !== '' || index !== '' || pageSize !== defaultPageSize;

  function clearFilters() {
    setSearch('');
    setIndex('');
    setPageSize(defaultPageSize);
  }

  return (
    <div className="feature-page module-page">
      <PageHeader
        title="Screener e Rankings"
        description="O screener usará as carteiras vigentes do IBOV, SMLL e IDIV para comparar as companhias elegíveis."
      />
      <Panel aria-label="Filtros do screener" className="screener-filters">
        <Input
          id="screener-search"
          label="Empresa ou ticker"
          placeholder="Buscar empresa ou ticker"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Select
          id="screener-index"
          label="Índice"
          value={index}
          onChange={(event) => setIndex(event.currentTarget.value as IndexCode | '')}
        >
          <option value="">Todos os índices</option>
          {INDEX_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
        <Select
          id="screener-page-size"
          label="Linhas por página"
          value={pageSize}
          onChange={(event) => setPageSize(event.currentTarget.value)}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <Button disabled={!hasFilters} onClick={clearFilters} variant="quiet">
          Limpar filtros
        </Button>
      </Panel>
      <EmptyState
        icon="database"
        title="Universo B3 indisponível"
        description="A formação do universo aguarda uma fonte autorizada para as composições dos índices. O histórico contábil da amostra já pode ser consultado em Empresas."
      >
        <ButtonLink to="/empresas">Consultar a amostra da CVM</ButtonLink>
      </EmptyState>
    </div>
  );
}
