import { Link } from 'react-router-dom';
import { ButtonLink, Icon, type IconName } from '../../shared/ui';

const modules = [
  {
    title: 'Empresas',
    description: 'Consulte contas consolidadas e o histórico dos envios à CVM.',
    to: '/empresas',
    icon: 'company',
  },
  {
    title: 'Screener e Rankings',
    description: 'Acompanhe a formação do universo de companhias elegíveis da B3.',
    to: '/screener',
    icon: 'screener',
  },
  {
    title: 'Valuation e Premissas',
    description: 'Estime o valor intrínseco com premissas que você pode revisar.',
    to: '/valuation',
    icon: 'valuation',
  },
] as const satisfies readonly {
  title: string;
  description: string;
  to: string;
  icon: IconName;
}[];

function AnalysisDiagram() {
  return (
    <div className="analysis-diagram">
      <div className="analysis-diagram__figure" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <dl className="analysis-diagram__legend">
        <div>
          <dt>Rentabilidade</dt>
          <dd>ROIC / ROE</dd>
        </div>
        <div>
          <dt>Custo de oportunidade</dt>
          <dd>Juros de 10 anos</dd>
        </div>
        <div>
          <dt>Valor intrínseco</dt>
          <dd>DCF / DDM</dd>
        </div>
      </dl>
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="feature-page overview-page">
      <section className="overview-hero" aria-labelledby="overview-title">
        <div className="overview-hero__content">
          <p className="overview-hero__subject">Análise fundamentalista da B3</p>
          <h1 id="overview-title">Qualidade, preço e valor.</h1>
          <p className="overview-hero__summary">
            Consulte contas da CVM e conheça a metodologia para analisar a rentabilidade, o preço de
            mercado e o valor intrínseco das empresas.
          </p>
          <div className="overview-hero__actions">
            <ButtonLink to="/empresas" variant="primary">
              Consultar contas da CVM <Icon name="arrow-right" size={17} />
            </ButtonLink>
            <ButtonLink to="/screener" variant="quiet">
              Explorar screener
            </ButtonLink>
          </div>
        </div>
        <AnalysisDiagram />
      </section>

      <section className="overview-modules" aria-labelledby="overview-modules">
        <div className="overview-modules__heading">
          <h2 id="overview-modules">Explore os módulos</h2>
        </div>
        <ul className="module-list" role="list">
          {modules.map(({ title, description, to, icon }) => (
            <li key={to}>
              <Link className="module-link" to={to}>
                <span className="module-link__icons">
                  <span className="ui-icon-box">
                    <Icon name={icon} size={19} />
                  </span>
                  <Icon className="module-link__arrow" name="arrow-up-right" size={18} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
