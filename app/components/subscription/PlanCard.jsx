/* eslint-disable react/prop-types */
export default function PlanCard({
  name,
  price,
  eyebrow,
  description,
  perks,
  features,
  widgetCount,
  totalWidgets,
  isPopular,
  isCurrentPlan,
  tone = "basic",
  onSubscribe,
}) {
  const formattedPrice = new Intl.NumberFormat("en-IN").format(price);
  const cardClassName = [
    "pricing-card",
    `pricing-card--${tone}`,
    isPopular ? "pricing-card--popular" : "",
    isCurrentPlan ? "pricing-card--current" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      {isPopular ? (
        <div className="pricing-card__badge">Most popular</div>
      ) : null}

      <div className="pricing-card__topline" aria-hidden="true" />

      <div className="pricing-card__header">
        <div>
          <span className="pricing-card__eyebrow">{eyebrow}</span>
          <h2>{name}</h2>
        </div>

        <div className="pricing-card__counter">
          <strong>{widgetCount}</strong>
          <span>/{totalWidgets}</span>
        </div>
      </div>

      <p className="pricing-card__description">{description}</p>

      <div className="pricing-card__price">
        <span className="pricing-card__currency">{"\u20B9"}</span>
        <span className="pricing-card__amount">{formattedPrice}</span>
        <span className="pricing-card__period">/month</span>
      </div>

      <div className="pricing-card__perks">
        {perks.map((perk) => (
          <span key={perk}>{perk}</span>
        ))}
      </div>

      <div className="pricing-card__divider" />

      <div className="pricing-card__feature-heading">
        <span>Widget access</span>
        <span>{widgetCount} included</span>
      </div>

      <ul className="pricing-card__features">
        {features.map((feature) => (
          <li
            key={feature.label}
            className={
              feature.available
                ? "pricing-feature pricing-feature--available"
                : "pricing-feature pricing-feature--locked"
            }
          >
            <span className="pricing-feature__icon" aria-hidden="true" />
            <span className="pricing-feature__label">{feature.label}</span>
            <span className="pricing-feature__group">{feature.group}</span>
          </li>
        ))}
      </ul>

      <div className="pricing-card__action">
        <button
          type="button"
          className="pricing-card__button"
          disabled={isCurrentPlan}
          onClick={onSubscribe}
        >
          {isCurrentPlan ? (
            <>
              Current plan <span aria-hidden="true">{"\u2713"}</span>
            </>
          ) : (
            "Subscribe"
          )}
        </button>
      </div>
    </article>
  );
}
