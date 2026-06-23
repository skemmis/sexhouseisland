import type { CastMember } from "../data/cast";

export function CastCard({ member }: { member: CastMember }) {
  return (
    <article className="cast-card">
      <div className="cast-card__photo">
        <img src={`/cast/${member.id}.jpg`} alt={member.name} loading="lazy" />
        <span className="cast-card__epithet">{member.epithet}</span>
      </div>
      <div className="cast-card__body">
        <h3 className="cast-card__name">{member.name}</h3>
        <p className="cast-card__meta">{member.age} · {member.hometown}</p>
        <p className="cast-card__bio">{member.bio}</p>
        <blockquote className="cast-card__quote">“{member.quote}”</blockquote>
        <p className="cast-card__tag">{member.tag}</p>
      </div>
    </article>
  );
}
