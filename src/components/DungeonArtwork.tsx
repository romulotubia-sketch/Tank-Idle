import React, { useState } from 'react';
import armoredStrongholdImg from '../assets/images/armored_stronghold_arena_1795129355514.jpg';
import arsenalDepotImg from '../assets/images/arsenal_depot_arena_1795129356645.jpg';
import experimentalGroundsImg from '../assets/images/experimental_grounds_arena_1795129355544.jpg';
import salvageYardImg from '../assets/images/salvage_yard_arena_1795129356351.jpg';
import type { DungeonId } from '../game/types';

const ARTWORK_MAP: Record<
  DungeonId,
  { src: string; alt: string; gradient: string }
> = {
  salvage_yard: {
    src: salvageYardImg,
    alt: 'Salvage Yard industrial tank scrapyard arena',
    gradient: 'from-stone-800 via-zinc-900 to-[#12151b]',
  },
  arsenal_depot: {
    src: arsenalDepotImg,
    alt: 'Arsenal Depot fortified military tank facility',
    gradient: 'from-slate-800 via-zinc-900 to-[#12151b]',
  },
  armored_stronghold: {
    src: armoredStrongholdImg,
    alt: 'Armored Stronghold fortified concrete bunker courtyard',
    gradient: 'from-zinc-800 via-neutral-900 to-[#12151b]',
  },
  experimental_grounds: {
    src: experimentalGroundsImg,
    alt: 'Experimental Grounds tactical weapons testing arena',
    gradient: 'from-stone-800 via-slate-900 to-[#12151b]',
  },
};

interface DungeonArtworkProps {
  dungeonId: DungeonId;
  className?: string;
}

export const DungeonArtwork: React.FC<DungeonArtworkProps> = ({
  dungeonId,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const meta = ARTWORK_MAP[dungeonId];

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient} ${className}`}
    >
      {!imgError && (
        <img
          src={meta.src}
          alt={meta.alt}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center opacity-75 grayscale-[15%]"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#12151b] via-[#12151b]/50 to-transparent pointer-events-none" />
    </div>
  );
};
