import pyarrow.dataset as ds, pyarrow.fs as fs, pyarrow.compute as pc, time, sys
REL="overturemaps-us-west-2/release/2026-10-21.0"
s3=fs.S3FileSystem(anonymous=True,region='us-west-2')
def lire(theme,typ,bbox,cols):
    d=ds.dataset(f"{REL}/theme={theme}/type={typ}/",filesystem=s3,format='parquet')
    x0,y0,x1,y1=bbox
    f=(pc.field('bbox','xmin')<=x1)&(pc.field('bbox','xmax')>=x0)&(pc.field('bbox','ymin')<=y1)&(pc.field('bbox','ymax')>=y0)
    return d,d.to_table(columns=cols,filter=f)
if __name__=="__main__":
    SF=(-122.52,37.70,-122.36,37.83)
    for theme,typ,cols in [("places","place",['id','names','taxonomy','basic_category','confidence','addresses','phones','websites','operating_status','geometry']),
                           ("buildings","building",['id','height','num_floors','geometry']),
                           ("transportation","segment",['id','subtype','class','names','geometry']),
                           ("base","water",['id','subtype','class','names','geometry']),
                           ("base","land_use",['id','subtype','class','names','geometry']),
                           ("divisions","division",['id','subtype','names','geometry'])]:
        t=time.time()
        try:
            d,tb=lire(theme,typ,SF,cols)
            print(theme,typ,tb.num_rows,'lignes',round(time.time()-t,1),'s',flush=True)
        except Exception as e: print(theme,typ,'ERREUR',str(e)[:200],flush=True)
